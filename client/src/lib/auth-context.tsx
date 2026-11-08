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
import { clearCache } from "./apollo/apollo-client";
import { AuthErrorHandler } from "./auth-error-handler";
import type { AuthContextType, AuthError, AuthUser, StoredAccountSession } from "./types/auth.types";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token storage utilities
const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "auth_user";
const TOKEN_EXPIRY_KEY = "token_expiry";
const MULTI_ACCOUNTS_KEY = "auth_multi_accounts";

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

const isTokenExpired = (expiresAt: string): boolean => {
	return new Date(expiresAt) <= new Date();
};

const getStoredAccounts = (): StoredAccountSession[] => {
	try {
		const stored = localStorage.getItem(MULTI_ACCOUNTS_KEY);
		if (!stored) return [];
		const parsed: StoredAccountSession[] = JSON.parse(stored);
		if (!Array.isArray(parsed)) return [];
		return parsed.map((acc) => ({
			...acc,
			isExpired: isTokenExpired(acc.expiresAt),
		}));
	} catch {
		return [];
	}
};

const setStoredAccounts = (accounts: StoredAccountSession[]) => {
	try {
		localStorage.setItem(MULTI_ACCOUNTS_KEY, JSON.stringify(accounts));
	} catch {}
};

const upsertStoredAccount = (
	token: string,
	refreshToken: string,
	user: AuthUser,
	expiresAt: string,
): StoredAccountSession[] => {
	const currentAccounts = getStoredAccounts();
	const existingIndex = currentAccounts.findIndex((acc) => acc.user.id === user.id);
	const session: StoredAccountSession = {
		user,
		token,
		refreshToken,
		expiresAt,
		lastActiveAt: Date.now(),
		isExpired: isTokenExpired(expiresAt),
	};
	let updated: StoredAccountSession[];
	if (existingIndex >= 0) {
		updated = [...currentAccounts];
		updated[existingIndex] = session;
	} else {
		updated = [...currentAccounts, session];
	}
	setStoredAccounts(updated);
	return updated;
};

const setStoredAuth = (token: string, refreshToken: string, user: AuthUser, expiresAt: string) => {
	localStorage.setItem(TOKEN_KEY, token);
	localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
	localStorage.setItem(USER_KEY, JSON.stringify(user));
	localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt);
	upsertStoredAccount(token, refreshToken, user, expiresAt);
};

const clearStoredAuth = () => {
	localStorage.removeItem(TOKEN_KEY);
	localStorage.removeItem(REFRESH_TOKEN_KEY);
	localStorage.removeItem(USER_KEY);
	localStorage.removeItem(TOKEN_EXPIRY_KEY);
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
	const [accounts, setAccounts] = useState<StoredAccountSession[]>(() => getStoredAccounts());
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
			const storedRefreshToken = getStoredRefreshToken();

			if (storedUser && storedToken && storedExpiry) {
				const syncedAccounts = upsertStoredAccount(
					storedToken,
					storedRefreshToken || "",
					storedUser,
					storedExpiry,
				);
				setAccounts(syncedAccounts);

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
			} else {
				setAccounts(getStoredAccounts());
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
					30000, // 30 second timeout
				);

				if (data?.login.success && data.login.data) {
					const { token, refreshToken, user: authUser, expiresAt } = data.login.data;
					setStoredAuth(token, refreshToken, authUser, expiresAt);
					const updated = upsertStoredAccount(token, refreshToken, authUser, expiresAt);
					setAccounts(updated);
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
					const updated = upsertStoredAccount(token, refreshToken, authUser, expiresAt);
					setAccounts(updated);
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

			const currentUserId = user?.id;
			clearStoredAuth();

			if (currentUserId) {
				const allAccounts = getStoredAccounts();
				const remaining = allAccounts.filter((acc) => acc.user.id !== currentUserId);
				setStoredAccounts(remaining);
				setAccounts(remaining);

				if (remaining.length > 0) {
					const next = [...remaining].sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0))[0];
					localStorage.setItem(TOKEN_KEY, next.token);
					localStorage.setItem(REFRESH_TOKEN_KEY, next.refreshToken);
					localStorage.setItem(USER_KEY, JSON.stringify(next.user));
					localStorage.setItem(TOKEN_EXPIRY_KEY, next.expiresAt);
					setUser(next.user);
					clearCache();
					setupTokenRefresh(next.expiresAt);
					toast.success(`Déconnecté. Basculé sur ${next.user.name}`);
					if (window.location.pathname !== "/") {
						window.location.href = "/";
					}
					return;
				}
			}

			clearCache();
			setAccounts([]);
			setUser(null);
			toast.success("Successfully logged out");
			if (window.location.pathname !== "/login") {
				window.location.href = "/login";
			}
		} finally {
			isLoggingOutRef.current = false;
		}
	}, [logoutMutation, user, setupTokenRefresh]);

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
				const updated = upsertStoredAccount(token, newRefreshToken, authUser, expiresAt);
				setAccounts(updated);
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

	const switchAccount = useCallback(
		async (targetUserId: string) => {
			const allAccounts = getStoredAccounts();
			const target = allAccounts.find((acc) => acc.user.id === targetUserId);
			if (!target) {
				toast.error("Compte introuvable.");
				return;
			}

			if (isTokenExpired(target.expiresAt)) {
				toast.error("Session expirée pour ce compte. Veuillez vous reconnecter.");
				return;
			}

			const updatedAccounts = allAccounts.map((acc) =>
				acc.user.id === target.user.id
					? { ...acc, lastActiveAt: Date.now(), isExpired: isTokenExpired(acc.expiresAt) }
					: acc,
			);
			setStoredAccounts(updatedAccounts);
			setAccounts(updatedAccounts);

			localStorage.setItem(TOKEN_KEY, target.token);
			localStorage.setItem(REFRESH_TOKEN_KEY, target.refreshToken);
			localStorage.setItem(USER_KEY, JSON.stringify(target.user));
			localStorage.setItem(TOKEN_EXPIRY_KEY, target.expiresAt);

			setUser(target.user);
			clearCache();
			setupTokenRefresh(target.expiresAt);

			toast.success(`Connecté en tant que ${target.user.name}`);

			if (window.location.pathname !== "/") {
				window.location.href = "/";
			}
		},
		[setupTokenRefresh],
	);

	const addAccount = useCallback(
		async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
			try {
				const { data } = await withTimeout(
					loginMutation({
						variables: {
							input: { email, password },
						},
					}),
					30000,
				);

				if (data?.login.success && data.login.data) {
					const { token, refreshToken: newRefreshToken, user: authUser, expiresAt } = data.login.data;
					const updated = upsertStoredAccount(token, newRefreshToken, authUser, expiresAt);
					setAccounts(updated);

					localStorage.setItem(TOKEN_KEY, token);
					localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
					localStorage.setItem(USER_KEY, JSON.stringify(authUser));
					localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt);

					setUser(authUser);
					clearCache();
					setupTokenRefresh(expiresAt);

					toast.success(`Compte ${authUser.name} connecté !`);
					if (window.location.pathname !== "/") {
						window.location.href = "/";
					}
					return { success: true };
				}

				const errMessage = data?.login.errors?.[0]?.message || "Échec de la connexion";
				return { success: false, error: errMessage };
			} catch (err) {
				const message = err instanceof Error ? err.message : "Erreur lors de l'ajout du compte";
				return { success: false, error: message };
			}
		},
		[loginMutation, setupTokenRefresh],
	);

	const removeAccountSession = useCallback(
		async (targetUserId: string) => {
			const allAccounts = getStoredAccounts();
			const remaining = allAccounts.filter((acc) => acc.user.id !== targetUserId);
			setStoredAccounts(remaining);
			setAccounts(remaining);

			if (user?.id === targetUserId) {
				if (remaining.length > 0) {
					const next = [...remaining].sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0))[0];
					await switchAccount(next.user.id);
				} else {
					await logout();
				}
			} else {
				toast.success("Compte détaché");
			}
		},
		[user, switchAccount, logout],
	);

	const logoutAllAccounts = useCallback(async () => {
		if (refreshTimeoutRef.current) {
			clearTimeout(refreshTimeoutRef.current);
			refreshTimeoutRef.current = null;
		}

		const token = getStoredToken();
		if (token) {
			try {
				await logoutMutation({
					variables: { input: { token } },
				});
			} catch {}
		}

		clearStoredAuth();
		localStorage.removeItem(MULTI_ACCOUNTS_KEY);
		clearCache();
		setAccounts([]);
		setUser(null);
		toast.success("Tous les comptes ont été déconnectés");
		if (window.location.pathname !== "/login") {
			window.location.href = "/login";
		}
	}, [logoutMutation]);

	const value: AuthContextType = {
		user,
		isLoading,
		isAuthenticated: !!user,
		isAdmin: user?.role === "ADMIN",
		accounts,
		login,
		register,
		logout,
		resetPassword,
		confirmPasswordReset,
		verifyEmail,
		resendVerification,
		refreshToken,
		updateUser,
		switchAccount,
		addAccount,
		removeAccountSession,
		logoutAllAccounts,
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

export function useSafeAuth() {
	return useContext(AuthContext);
}
