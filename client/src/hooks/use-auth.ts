import { useQuery } from "@apollo/client";
import { useCallback, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import {
	type AccentColor,
	applyShadcnThemePreferences,
	type BaseColor,
	type FontPreference,
	type HeadingFont,
	loadShadcnThemePreferences,
	type MenuAccent,
	type MenuColor,
	resolveThemeMode,
	type ShadcnThemePreferences,
	saveShadcnThemePreferences,
	type ThemeMode,
	type ThemeStyle,
} from "@/lib/theme/shadcn-theme";
import { ME_QUERY } from "../graphql/queries/auth.queries";
import { useAuth as useAuthContext } from "../lib/auth-context";
import type { AuthUser } from "../lib/types/auth.types";

function buildThemePreferences(user: AuthUser): ShadcnThemePreferences | null {
	// Check if any theme fields are present
	const hasThemeFields =
		user.themePreference ||
		user.themeBaseColor ||
		user.themeAccentColor ||
		user.themeFontPreference ||
		user.themeHeadingFont ||
		user.themeMenuAccent ||
		user.themeMenuColor ||
		user.themeStyle ||
		typeof user.themeRadius === "number" ||
		typeof user.themeRTL === "boolean";

	if (!hasThemeFields) {
		return null;
	}

	const currentLocal = loadShadcnThemePreferences();
	return {
		style: (user.themeStyle ?? currentLocal.style) as ThemeStyle,
		baseColor: (user.themeBaseColor ?? currentLocal.baseColor) as BaseColor,
		accentColor: (user.themeAccentColor ?? currentLocal.accentColor) as AccentColor,
		fontPreference: (user.themeFontPreference ?? currentLocal.fontPreference) as FontPreference,
		headingFont: (user.themeHeadingFont ?? currentLocal.headingFont) as HeadingFont,
		radius: typeof user.themeRadius === "number" ? user.themeRadius : currentLocal.radius,
		menuAccent: (user.themeMenuAccent ?? currentLocal.menuAccent) as MenuAccent,
		menuColor: (user.themeMenuColor ?? currentLocal.menuColor) as MenuColor,
		rtl: typeof user.themeRTL === "boolean" ? user.themeRTL : currentLocal.rtl,
	};
}

/**
 * Enhanced authentication hook that provides current user data and auth state
 */
export const useAuth = () => {
	const authContext = useAuthContext();

	// Query current user data from server
	const { data, loading, error, refetch } = useQuery<{ me: AuthUser }>(ME_QUERY, {
		skip: !authContext.isAuthenticated,
		errorPolicy: "all",
		fetchPolicy: "cache-first",
		onError: (error) => {
			// If token is invalid, logout user
			if (error.graphQLErrors.some((err) => err.extensions?.code === "UNAUTHENTICATED")) {
				authContext.logout();
			}
		},
	});

	const { setTheme } = useTheme();

	// Sync server user data with local context (state + localStorage).
	// Always sync when ME_QUERY returns data so that fields like
	// displayCurrency are persisted across sessions even when the
	// user ID hasn't changed.
	useEffect(() => {
		if (data?.me) {
			// Strip __typename from Apollo cache object before persisting
			const { __typename, ...userFields } = data.me as AuthUser & {
				__typename?: string;
			};
			authContext.updateUser(userFields);

			// Apply theme preferences from backend if present
			const backendPrefs = buildThemePreferences(data.me);
			if (backendPrefs) {
				const currentLocal = loadShadcnThemePreferences();
				const hasChanged =
					backendPrefs.style !== currentLocal.style ||
					backendPrefs.baseColor !== currentLocal.baseColor ||
					backendPrefs.accentColor !== currentLocal.accentColor ||
					backendPrefs.fontPreference !== currentLocal.fontPreference ||
					backendPrefs.headingFont !== currentLocal.headingFont ||
					backendPrefs.radius !== currentLocal.radius ||
					backendPrefs.menuAccent !== currentLocal.menuAccent ||
					backendPrefs.menuColor !== currentLocal.menuColor ||
					backendPrefs.rtl !== currentLocal.rtl;

				if (hasChanged) {
					saveShadcnThemePreferences(backendPrefs);
					applyShadcnThemePreferences(
						backendPrefs,
						resolveThemeMode((data.me.themePreference ?? "system") as ThemeMode),
					);
				}

				if (data.me.themePreference && data.me.themePreference !== "system") {
					setTheme(data.me.themePreference as "light" | "dark" | "system");
				}
			}
		}
	}, [data?.me, setTheme, authContext.updateUser]);

	const refreshUserData = useCallback(async () => {
		try {
			await refetch();
		} catch (_error) {}
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
