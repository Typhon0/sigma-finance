import type { AuthUser } from "./types/auth.types";

/**
 * Authentication utility functions
 */

// Storage keys
export const AUTH_STORAGE_KEYS = {
	TOKEN: "auth_token",
	REFRESH_TOKEN: "refresh_token",
	USER: "auth_user",
	TOKEN_EXPIRY: "token_expiry",
} as const;

/**
 * Token management utilities
 */
export class TokenManager {
	static getToken(): string | null {
		return localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
	}

	static getRefreshToken(): string | null {
		return localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
	}

	static getTokenExpiry(): string | null {
		return localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRY);
	}

	static getUser(): AuthUser | null {
		const stored = localStorage.getItem(AUTH_STORAGE_KEYS.USER);
		return stored ? JSON.parse(stored) : null;
	}

	static setAuth(token: string, refreshToken: string, user: AuthUser, expiresAt: string): void {
		localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, token);
		localStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
		localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(user));
		localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRY, expiresAt);
	}

	static clearAuth(): void {
		localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
		localStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
		localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
		localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRY);
	}

	static isTokenExpired(expiresAt?: string): boolean {
		if (!expiresAt) {
			const stored = TokenManager.getTokenExpiry();
			if (!stored) return true;
			expiresAt = stored;
		}
		return new Date(expiresAt) <= new Date();
	}

	static shouldRefreshToken(expiresAt?: string): boolean {
		if (!expiresAt) {
			const stored = TokenManager.getTokenExpiry();
			if (!stored) return false;
			expiresAt = stored;
		}

		const expiry = new Date(expiresAt);
		const now = new Date();
		const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
		return expiry.getTime() - now.getTime() < fiveMinutes;
	}

	static getTimeUntilExpiry(expiresAt?: string): number {
		if (!expiresAt) {
			const stored = TokenManager.getTokenExpiry();
			if (!stored) return 0;
			expiresAt = stored;
		}

		const expiry = new Date(expiresAt);
		const now = new Date();
		return Math.max(0, expiry.getTime() - now.getTime());
	}

	static hasValidToken(): boolean {
		const token = TokenManager.getToken();
		const expiry = TokenManager.getTokenExpiry();
		return !!(token && expiry && !TokenManager.isTokenExpired(expiry));
	}
}

/**
 * Authentication state utilities
 */
export class AuthState {
	static isAuthenticated(): boolean {
		return TokenManager.hasValidToken() && !!TokenManager.getUser();
	}

	static isEmailVerified(): boolean {
		const user = TokenManager.getUser();
		return user?.emailVerified ?? false;
	}

	static getCurrentUser(): AuthUser | null {
		return TokenManager.getUser();
	}

	static getUserId(): string | null {
		const user = TokenManager.getUser();
		return user?.id ?? null;
	}

	static getUserEmail(): string | null {
		const user = TokenManager.getUser();
		return user?.email ?? null;
	}

	static canAccessProtectedRoute(): boolean {
		return AuthState.isAuthenticated();
	}

	static canAccessEmailVerifiedRoute(): boolean {
		return AuthState.isAuthenticated() && AuthState.isEmailVerified();
	}
}

/**
 * URL and redirect utilities
 */
export class AuthRedirect {
	private static readonly LOGIN_PATH = "/login";
	private static readonly DASHBOARD_PATH = "/dashboard";
	private static readonly EMAIL_VERIFICATION_PATH = "/verify-email";

	static getLoginUrl(returnTo?: string): string {
		const url = new URL(AuthRedirect.LOGIN_PATH, window.location.origin);
		if (returnTo) {
			url.searchParams.set("returnTo", returnTo);
		}
		return url.toString();
	}

	static getReturnUrl(): string {
		const params = new URLSearchParams(window.location.search);
		return params.get("returnTo") || AuthRedirect.DASHBOARD_PATH;
	}

	static redirectToLogin(returnTo?: string): void {
		const currentPath = returnTo || window.location.pathname + window.location.search;
		window.location.href = AuthRedirect.getLoginUrl(currentPath);
	}

	static redirectToDashboard(): void {
		window.location.href = AuthRedirect.DASHBOARD_PATH;
	}

	static redirectToEmailVerification(): void {
		window.location.href = AuthRedirect.EMAIL_VERIFICATION_PATH;
	}

	static redirectAfterLogin(): void {
		const returnUrl = AuthRedirect.getReturnUrl();
		window.location.href = returnUrl;
	}
}

/**
 * Password validation utilities
 */
export class PasswordValidator {
	private static readonly MIN_LENGTH = 8;
	private static readonly PATTERNS = {
		lowercase: /[a-z]/,
		uppercase: /[A-Z]/,
		number: /\d/,
		special: /[!@#$%^&*(),.?":{}|<>]/,
	};

	static validate(password: string): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (password.length < PasswordValidator.MIN_LENGTH) {
			errors.push(`Password must be at least ${PasswordValidator.MIN_LENGTH} characters long`);
		}

		if (!PasswordValidator.PATTERNS.lowercase.test(password)) {
			errors.push("Password must contain at least one lowercase letter");
		}

		if (!PasswordValidator.PATTERNS.uppercase.test(password)) {
			errors.push("Password must contain at least one uppercase letter");
		}

		if (!PasswordValidator.PATTERNS.number.test(password)) {
			errors.push("Password must contain at least one number");
		}

		if (!PasswordValidator.PATTERNS.special.test(password)) {
			errors.push("Password must contain at least one special character");
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	static getStrength(password: string): "weak" | "medium" | "strong" {
		let score = 0;

		if (password.length >= PasswordValidator.MIN_LENGTH) score++;
		if (PasswordValidator.PATTERNS.lowercase.test(password)) score++;
		if (PasswordValidator.PATTERNS.uppercase.test(password)) score++;
		if (PasswordValidator.PATTERNS.number.test(password)) score++;
		if (PasswordValidator.PATTERNS.special.test(password)) score++;

		if (score <= 2) return "weak";
		if (score <= 4) return "medium";
		return "strong";
	}
}

/**
 * Email validation utilities
 */
export class EmailValidator {
	private static readonly EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	static validate(email: string): boolean {
		return EmailValidator.EMAIL_PATTERN.test(email);
	}

	static normalize(email: string): string {
		return email.toLowerCase().trim();
	}
}

/**
 * Session management utilities
 */
export class SessionManager {
	private static readonly SESSION_WARNING_TIME = 5 * 60 * 1000; // 5 minutes before expiry

	static shouldShowSessionWarning(): boolean {
		const expiry = TokenManager.getTokenExpiry();
		if (!expiry) return false;

		const timeUntilExpiry = TokenManager.getTimeUntilExpiry(expiry);
		return timeUntilExpiry > 0 && timeUntilExpiry <= SessionManager.SESSION_WARNING_TIME;
	}

	static getSessionTimeRemaining(): number {
		const expiry = TokenManager.getTokenExpiry();
		if (!expiry) return 0;
		return TokenManager.getTimeUntilExpiry(expiry);
	}

	static formatTimeRemaining(milliseconds: number): string {
		const minutes = Math.floor(milliseconds / (1000 * 60));
		const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	}
}
