import { ApolloError } from "@apollo/client";
import { useCallback, useState } from "react";

export interface ErrorState {
	hasError: boolean;
	error: Error | ApolloError | null;
	isRetrying: boolean;
}

export interface ErrorHandlingOptions {
	onError?: (error: Error | ApolloError) => void;
	maxRetries?: number;
	retryDelay?: number;
}

/**
 * Hook for handling errors with retry functionality
 * Specifically designed for dashboard sections with GraphQL integration
 */
export function useErrorHandling(options: ErrorHandlingOptions = {}) {
	const { onError, maxRetries = 3, retryDelay = 1000 } = options;

	const [errorState, setErrorState] = useState<ErrorState>({
		hasError: false,
		error: null,
		isRetrying: false,
	});

	const [retryCount, setRetryCount] = useState(0);

	const handleError = useCallback(
		(error: Error | ApolloError) => {
			setErrorState({
				hasError: true,
				error,
				isRetrying: false,
			});

			// Call custom error handler if provided
			if (onError) {
				onError(error);
			}

			// Report to monitoring service if available
			if (typeof window !== "undefined") {
				const reportErrorFn = (
					window as unknown as { reportError?: (error: unknown, data: unknown) => void }
				).reportError;
				if (typeof reportErrorFn === "function") {
					reportErrorFn(error, {
						context: "dashboard-section",
						retryCount,
					});
				}
			}
		},
		[onError, retryCount],
	);

	const retry = useCallback(
		async (retryFn?: () => Promise<void> | void) => {
			if (retryCount >= maxRetries) {
				return;
			}

			setErrorState((prev) => ({
				...prev,
				isRetrying: true,
			}));

			try {
				// Add delay before retry
				if (retryDelay > 0) {
					await new Promise((resolve) => setTimeout(resolve, retryDelay));
				}

				// Execute retry function if provided
				if (retryFn) {
					await retryFn();
				}

				// Reset error state on successful retry
				setErrorState({
					hasError: false,
					error: null,
					isRetrying: false,
				});

				setRetryCount(0);
			} catch (error) {
				setRetryCount((prev) => prev + 1);
				handleError(error as Error | ApolloError);
			}
		},
		[retryCount, maxRetries, retryDelay, handleError],
	);

	const clearError = useCallback(() => {
		setErrorState({
			hasError: false,
			error: null,
			isRetrying: false,
		});
		setRetryCount(0);
	}, []);

	const canRetry = retryCount < maxRetries;

	return {
		...errorState,
		handleError,
		retry,
		clearError,
		canRetry,
		retryCount,
		maxRetries,
	};
}

/**
 * Utility function to determine if an error is a network error
 */
export function isNetworkError(error: Error | ApolloError): boolean {
	if (error instanceof ApolloError) {
		return error.networkError !== null;
	}

	return (
		error.message.toLowerCase().includes("network") ||
		error.message.toLowerCase().includes("fetch") ||
		error.message.toLowerCase().includes("connection")
	);
}

/**
 * Utility function to determine if an error is a GraphQL error
 */
export function isGraphQLError(error: Error | ApolloError): boolean {
	if (error instanceof ApolloError) {
		return error.graphQLErrors.length > 0;
	}

	return false;
}

/**
 * Get user-friendly error message from Apollo error
 */
export function getErrorMessage(error: Error | ApolloError): string {
	if (error instanceof ApolloError) {
		// Network errors
		if (error.networkError) {
			if (error.networkError.message.includes("Failed to fetch")) {
				return "Unable to connect to server. Please check your internet connection.";
			}
			return "Network error occurred. Please try again.";
		}

		// GraphQL errors
		if (error.graphQLErrors.length > 0) {
			const firstError = error.graphQLErrors[0];
			return firstError.message || "A server error occurred.";
		}
	}

	return error.message || "An unexpected error occurred.";
}

/**
 * Hook specifically for Apollo GraphQL error handling
 */
export function useApolloErrorHandling(options: ErrorHandlingOptions = {}) {
	const errorHandling = useErrorHandling(options);

	const handleApolloError = useCallback(
		(error: ApolloError) => {
			errorHandling.handleError(error);
		},
		[errorHandling],
	);

	return {
		...errorHandling,
		handleApolloError,
		isNetworkError: errorHandling.error ? isNetworkError(errorHandling.error) : false,
		isGraphQLError: errorHandling.error ? isGraphQLError(errorHandling.error) : false,
		userFriendlyMessage: errorHandling.error ? getErrorMessage(errorHandling.error) : "",
	};
}
