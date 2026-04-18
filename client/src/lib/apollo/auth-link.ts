import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { fromPromise } from "@apollo/client/link/utils";
import { toast } from "sonner";

// Token storage utilities
const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const TOKEN_EXPIRY_KEY = "token_expiry";

const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
const getStoredRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
const getStoredTokenExpiry = () => localStorage.getItem(TOKEN_EXPIRY_KEY);

const _isTokenExpired = (expiresAt: string): boolean => {
	return new Date(expiresAt) <= new Date();
};

const shouldRefreshToken = (expiresAt: string): boolean => {
	const expiry = new Date(expiresAt);
	const now = new Date();
	const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
	return expiry.getTime() - now.getTime() < fiveMinutes;
};

const AUTH_OPERATION_NAMES = new Set([
	"Login",
	"Register",
	"RefreshToken",
	"Logout",
	"ResetPassword",
	"ConfirmPasswordReset",
	"VerifyEmail",
	"ResendVerification",
]);

const shouldSkipRefreshForOperation = (operationName?: string | null): boolean => {
	if (!operationName) {
		return false;
	}
	return AUTH_OPERATION_NAMES.has(operationName);
};

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

/**
 * Refresh the authentication token
 */
const refreshAuthToken = async (): Promise<string> => {
	if (isRefreshing && refreshPromise) {
		return refreshPromise;
	}

	isRefreshing = true;

	refreshPromise = new Promise(async (resolve, reject) => {
		try {
			const refreshToken = getStoredRefreshToken();
			if (!refreshToken) {
				throw new Error("No refresh token available");
			}

			const graphqlEndpoint =
				import.meta.env.VITE_GRAPHQL_ENDPOINT || "/graphql";
			const response = await fetch(graphqlEndpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					query: `
            mutation RefreshToken($input: RefreshTokenInput!) {
              refreshToken(input: $input) {
                success
                data {
                  token
                  refreshToken
                  expiresAt
                  user {
                    id
                    email
                    name
                    emailVerified
                  }
                }
                errors {
                  code
                  message
                }
              }
            }
          `,
					variables: {
						input: { refreshToken },
					},
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const responseText = await response.text();
			if (!responseText) {
				throw new Error("Empty response from server");
			}

			let result;
			try {
				result = JSON.parse(responseText);
			} catch (parseError) {
				console.error("Failed to parse response as JSON:", responseText);
				throw new Error(`Invalid JSON response: ${parseError.message}`);
			}

			if (result.data?.refreshToken?.success && result.data.refreshToken.data) {
				const {
					token,
					refreshToken: newRefreshToken,
					expiresAt,
					user,
				} = result.data.refreshToken.data;

				// Update stored tokens
				localStorage.setItem(TOKEN_KEY, token);
				localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
				localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt);
				localStorage.setItem("auth_user", JSON.stringify(user));

				resolve(token);
			} else {
				throw new Error("Token refresh failed");
			}
		} catch (error) {
			console.error("Token refresh error:", error);

			// Clear stored auth data on refresh failure
			localStorage.removeItem(TOKEN_KEY);
			localStorage.removeItem(REFRESH_TOKEN_KEY);
			localStorage.removeItem(TOKEN_EXPIRY_KEY);
			localStorage.removeItem("auth_user");

			reject(error);
		} finally {
			isRefreshing = false;
			refreshPromise = null;
		}
	});

	return refreshPromise;
};

/**
 * Authentication link that adds JWT token to requests and handles token refresh
 */
export const authLink = setContext(async (_, { headers }) => {
	let token = getStoredToken();
	const expiry = getStoredTokenExpiry();
	const operationName = headers?.["x-operation-name"] as string | undefined;

	// Check if token needs refresh
	if (
		token &&
		expiry &&
		shouldRefreshToken(expiry) &&
		!shouldSkipRefreshForOperation(operationName)
	) {
		try {
			token = await refreshAuthToken();
		} catch (error) {
			console.error("Failed to refresh token:", error);
			// Continue with existing token, let error handling deal with it
		}
	}

	const authHeaders = {
		headers: {
			...headers,
			authorization: token ? `Bearer ${token}` : "",
		},
	};

	return authHeaders;
});

/**
 * Error link that handles authentication errors and token refresh
 */
export const authErrorLink = onError(
	({ graphQLErrors, networkError, operation, forward }) => {
		if (graphQLErrors) {
			for (const error of graphQLErrors) {
				// Handle authentication errors
				if (error.extensions?.code === "UNAUTHENTICATED") {
					const token = getStoredToken();
					const refreshToken = getStoredRefreshToken();

					if (token && refreshToken && !isRefreshing) {
						// Try to refresh token and retry the operation
					return fromPromise(
						refreshAuthToken().catch(() => {
							// If refresh fails, redirect to login
							toast.error("Your session has expired. Please log in again.");
							window.location.href = "/auth/login";
							return "";
						}),
					).flatMap((newToken) => {
							if (newToken) {
								// Retry the operation with new token
								const oldHeaders = operation.getContext().headers;
								operation.setContext({
									headers: {
										...oldHeaders,
										authorization: `Bearer ${newToken}`,
									},
								});
								return forward(operation);
							}
							return [];
						});
					} else {
						// No refresh token or already refreshing, redirect to login
						toast.error("Please log in to continue.");
						window.location.href = "/auth/login";
					}
				}

				// Handle other GraphQL errors
				if (error.extensions?.code === "FORBIDDEN") {
					toast.error("You do not have permission to perform this action.");
				}
			}
		}

		if (networkError) {
			console.error("Network error:", networkError);

			// Handle network errors
			if ("statusCode" in networkError && networkError.statusCode === 401) {
				toast.error("Your session has expired. Please log in again.");
				window.location.href = "/auth/login";
			} else if (
				"statusCode" in networkError &&
				networkError.statusCode >= 500
			) {
				toast.error("Server error. Please try again later.");
			} else {
				toast.error("Network error. Please check your connection.");
			}
		}
	},
);
