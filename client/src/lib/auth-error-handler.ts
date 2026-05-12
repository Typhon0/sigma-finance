import { toast } from "sonner";
import { AUTH_ERROR_CODES, type AuthError, type AuthErrorCode } from "./types/auth.types";

/**
 * Maps backend error codes to user-friendly messages
 */
const ERROR_MESSAGES: Record<AuthErrorCode, string> = {
	[AUTH_ERROR_CODES.INVALID_CREDENTIALS]: "Invalid email or password. Please try again.",
	[AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS]: "An account with this email already exists.",
	[AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED]: "Please verify your email address before logging in.",
	[AUTH_ERROR_CODES.ACCOUNT_LOCKED]:
		"Your account has been temporarily locked due to too many failed login attempts. Please try again later.",
	[AUTH_ERROR_CODES.INVALID_TOKEN]: "Invalid or expired token. Please try again.",
	[AUTH_ERROR_CODES.TOKEN_EXPIRED]: "Your session has expired. Please log in again.",
	[AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED]:
		"Too many requests. Please wait a moment before trying again.",
	[AUTH_ERROR_CODES.WEAK_PASSWORD]:
		"Password must be at least 8 characters long and contain a mix of letters, numbers, and symbols.",
	[AUTH_ERROR_CODES.INVALID_EMAIL]: "Please enter a valid email address.",
	[AUTH_ERROR_CODES.INTERNAL_ERROR]: "Something went wrong. Please try again later.",
	[AUTH_ERROR_CODES.INVALID_INPUT]: "Please check your input and try again.",
};

/**
 * Handles authentication errors with user-friendly messages and appropriate actions
 */
export class AuthErrorHandler {
	/**
	 * Display error message to user
	 */
	static showError(error: AuthError): void {
		const message =
			ERROR_MESSAGES[error.code as AuthErrorCode] ||
			error.message ||
			"An unexpected error occurred.";
		toast.error(message);
	}

	/**
	 * Display multiple errors to user
	 */
	static showErrors(errors: AuthError[]): void {
		if (errors.length === 0) return;

		if (errors.length === 1) {
			AuthErrorHandler.showError(errors[0]);
			return;
		}

		// For multiple errors, show the first one and indicate there are more
		const firstError = errors[0];
		const message = ERROR_MESSAGES[firstError.code as AuthErrorCode] || firstError.message;
		toast.error(`${message} (${errors.length - 1} more error${errors.length > 2 ? "s" : ""})`);
	}

	/**
	 * Check if error requires specific action (like logout)
	 */
	static requiresLogout(error: AuthError): boolean {
		return [AUTH_ERROR_CODES.TOKEN_EXPIRED, AUTH_ERROR_CODES.INVALID_TOKEN].includes(
			// biome-ignore lint/suspicious/noExplicitAny: unavoidable
			error.code as any,
		);
	}

	/**
	 * Check if error indicates account needs verification
	 */
	static needsEmailVerification(error: AuthError): boolean {
		return error.code === AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED;
	}

	/**
	 * Check if error indicates account is locked
	 */
	static isAccountLocked(error: AuthError): boolean {
		return error.code === AUTH_ERROR_CODES.ACCOUNT_LOCKED;
	}

	/**
	 * Check if error is due to rate limiting
	 */
	static isRateLimited(error: AuthError): boolean {
		return error.code === AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED;
	}

	/**
	 * Get field-specific error message
	 */
	static getFieldError(errors: AuthError[], field: string): string | undefined {
		const fieldError = errors.find((error) => error.field === field);
		if (!fieldError) return undefined;

		return ERROR_MESSAGES[fieldError.code as AuthErrorCode] || fieldError.message;
	}

	/**
	 * Get all field errors as a map
	 */
	static getFieldErrors(errors: AuthError[]): Record<string, string> {
		const fieldErrors: Record<string, string> = {};

		errors.forEach((error) => {
			if (error.field) {
				fieldErrors[error.field] = ERROR_MESSAGES[error.code as AuthErrorCode] || error.message;
			}
		});

		return fieldErrors;
	}

	/**
	 * Handle authentication response with errors
	 */
	static handleAuthResponse<T>(
		response: { success: boolean; data?: T; errors?: AuthError[] },
		onSuccess?: (data: T) => void,
		onError?: (errors: AuthError[]) => void,
	): T | null {
		if (response.success && response.data) {
			onSuccess?.(response.data);
			return response.data;
		}

		if (response.errors && response.errors.length > 0) {
			AuthErrorHandler.showErrors(response.errors);
			onError?.(response.errors);
		}

		return null;
	}
}

/**
 * Hook for handling authentication errors in components
 */
export const useAuthErrorHandler = () => {
	return {
		showError: AuthErrorHandler.showError,
		showErrors: AuthErrorHandler.showErrors,
		getFieldError: AuthErrorHandler.getFieldError,
		getFieldErrors: AuthErrorHandler.getFieldErrors,
		handleAuthResponse: AuthErrorHandler.handleAuthResponse,
		requiresLogout: AuthErrorHandler.requiresLogout,
		needsEmailVerification: AuthErrorHandler.needsEmailVerification,
		isAccountLocked: AuthErrorHandler.isAccountLocked,
		isRateLimited: AuthErrorHandler.isRateLimited,
	};
};
