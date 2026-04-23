import { ApolloError } from "@apollo/client";
import { useCallback, useRef, useState } from "react";

export interface RetryOptions {
	maxRetries?: number;
	retryDelay?: number;
	exponentialBackoff?: boolean;
	retryCondition?: (error: Error | ApolloError) => boolean;
	onRetryAttempt?: (attempt: number, error: Error | ApolloError) => void;
	onMaxRetriesReached?: (error: Error | ApolloError) => void;
}

export interface RetryState {
	isRetrying: boolean;
	retryCount: number;
	lastError: Error | ApolloError | null;
	canRetry: boolean;
}

export function useRetryMechanism(options: RetryOptions = {}) {
	const {
		maxRetries = 3,
		retryDelay = 1000,
		exponentialBackoff = true,
		retryCondition = () => true,
		onRetryAttempt,
		onMaxRetriesReached,
	} = options;

	const [retryState, setRetryState] = useState<RetryState>({
		isRetrying: false,
		retryCount: 0,
		lastError: null,
		canRetry: true,
	});

	const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const calculateDelay = useCallback(
		(attempt: number) => {
			if (exponentialBackoff) {
				return retryDelay * 2 ** (attempt - 1);
			}
			return retryDelay;
		},
		[retryDelay, exponentialBackoff],
	);

	const executeWithRetry = useCallback(
		async <T>(operation: () => Promise<T>): Promise<T> => {
			let lastError: Error | ApolloError;

			for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
				try {
					if (attempt > 1) {
						setRetryState((prev) => ({
							...prev,
							isRetrying: true,
							retryCount: attempt - 1,
						}));

						onRetryAttempt?.(attempt - 1, lastError!);

						const delay = calculateDelay(attempt - 1);
						await new Promise((resolve) => {
							retryTimeoutRef.current = setTimeout(resolve, delay);
						});
					}

					const result = await operation();

					// Success - reset retry state
					setRetryState({
						isRetrying: false,
						retryCount: 0,
						lastError: null,
						canRetry: true,
					});

					return result;
				} catch (error) {
					lastError = error as Error | ApolloError;

					setRetryState((prev) => ({
						...prev,
						lastError,
						canRetry: attempt <= maxRetries && retryCondition(lastError),
					}));

					// If this is the last attempt or retry condition fails, throw the error
					if (attempt > maxRetries || !retryCondition(lastError)) {
						setRetryState((prev) => ({
							...prev,
							isRetrying: false,
							canRetry: false,
						}));

						if (attempt > maxRetries) {
							onMaxRetriesReached?.(lastError);
						}

						throw lastError;
					}
				}
			}

			throw lastError!;
		},
		[maxRetries, retryCondition, onRetryAttempt, onMaxRetriesReached, calculateDelay],
	);

	const manualRetry = useCallback(
		async <T>(operation: () => Promise<T>): Promise<T> => {
			if (!retryState.canRetry) {
				throw new Error("Maximum retries reached or retry not allowed");
			}

			return executeWithRetry(operation);
		},
		[executeWithRetry, retryState.canRetry],
	);

	const reset = useCallback(() => {
		if (retryTimeoutRef.current) {
			clearTimeout(retryTimeoutRef.current);
			retryTimeoutRef.current = null;
		}

		setRetryState({
			isRetrying: false,
			retryCount: 0,
			lastError: null,
			canRetry: true,
		});
	}, []);

	const cancel = useCallback(() => {
		if (retryTimeoutRef.current) {
			clearTimeout(retryTimeoutRef.current);
			retryTimeoutRef.current = null;
		}

		setRetryState((prev) => ({
			...prev,
			isRetrying: false,
			canRetry: false,
		}));
	}, []);

	return {
		...retryState,
		executeWithRetry,
		manualRetry,
		reset,
		cancel,
		maxRetries,
	};
}

// Specialized retry hook for Apollo GraphQL operations
export function useApolloRetry(options: RetryOptions = {}) {
	const defaultRetryCondition = (error: Error | ApolloError) => {
		if (error instanceof ApolloError) {
			// Don't retry on authentication errors
			if (error.graphQLErrors.some((e) => e.extensions?.code === "UNAUTHORIZED")) {
				return false;
			}

			// Don't retry on validation errors
			if (error.graphQLErrors.some((e) => e.extensions?.code === "BAD_USER_INPUT")) {
				return false;
			}

			// Retry on network errors
			if (error.networkError) {
				return true;
			}

			// Retry on server errors
			if (error.graphQLErrors.some((e) => e.extensions?.code === "INTERNAL_SERVER_ERROR")) {
				return true;
			}
		}

		// Retry on network-related errors
		if (
			error.message.includes("Failed to fetch") ||
			error.message.includes("NetworkError") ||
			error.message.includes("timeout")
		) {
			return true;
		}

		return false;
	};

	return useRetryMechanism({
		...options,
		retryCondition: options.retryCondition || defaultRetryCondition,
	});
}

// Portfolio-specific retry hook
export function usePortfolioRetry(options: RetryOptions = {}) {
	const portfolioRetryCondition = (error: Error | ApolloError) => {
		if (error instanceof ApolloError) {
			// Don't retry on portfolio not found
			if (error.graphQLErrors.some((e) => e.extensions?.code === "NOT_FOUND")) {
				return false;
			}

			// Don't retry on permission errors
			if (error.graphQLErrors.some((e) => e.extensions?.code === "UNAUTHORIZED")) {
				return false;
			}

			// Don't retry on validation errors (duplicate name, etc.)
			if (error.graphQLErrors.some((e) => e.extensions?.code === "BAD_USER_INPUT")) {
				return false;
			}
		}

		// Use default Apollo retry logic for other cases
		return true;
	};

	return useApolloRetry({
		...options,
		retryCondition: options.retryCondition || portfolioRetryCondition,
		maxRetries: options.maxRetries || 2, // Lower retry count for portfolio operations
	});
}
